package expo.modules.burnin

import android.graphics.Bitmap
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLUtils
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

internal class GlException(message: String) :
  expo.modules.kotlin.exception.CodedException("The video could not be drawn: $message")

/**
 * The compositor: one decoded video frame, one caption overlay, one output frame.
 *
 * Everything is drawn straight into the encoder's input surface, so no frame is
 * ever copied back to the CPU. The video arrives as an external texture from the
 * decoder and the captions as a bitmap this class uploads, and the only work the
 * GPU does is two textured quads.
 *
 * Rotation is baked in here rather than left to an orientation hint in the file.
 * A hint asks the player to rotate, and players that ignore it — including some
 * upload pipelines — would show the video sideways with the captions the right
 * way up. What is written is already upright.
 */
internal class GlScene(encoderSurface: Surface, private val width: Int, private val height: Int) {
  private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
  private var context: EGLContext = EGL14.EGL_NO_CONTEXT
  private var surface: EGLSurface = EGL14.EGL_NO_SURFACE

  /** The decoder draws into this. Handed to a `SurfaceTexture`. */
  var videoTextureId = 0
    private set

  private var overlayTextureId = 0
  private var overlayUploaded = false

  private var videoProgram = 0
  private var overlayProgram = 0

  private val videoVertices: FloatBuffer = floats(QUAD_POSITIONS)
  private var videoTexCoords: FloatBuffer = floats(QUAD_TEX_COORDS)
  private val overlayTexCoords: FloatBuffer = floats(OVERLAY_TEX_COORDS)

  init {
    setUpEgl(encoderSurface)
    videoProgram = buildProgram(VERTEX_SHADER, VIDEO_FRAGMENT_SHADER)
    overlayProgram = buildProgram(VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER)
    videoTextureId = createTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES)
    overlayTextureId = createTexture(GLES20.GL_TEXTURE_2D)
  }

  /**
   * Turns the source's rotation metadata into the texture coordinates that undo it.
   *
   * The output surface is already the upright size, so sampling the landscape
   * texture through rotated coordinates is all that is left to do.
   */
  fun setRotation(degrees: Int) {
    val coords = when (((degrees % 360) + 360) % 360) {
      90 -> floatArrayOf(0f, 1f, 0f, 0f, 1f, 1f, 1f, 0f)
      180 -> floatArrayOf(1f, 1f, 0f, 1f, 1f, 0f, 0f, 0f)
      270 -> floatArrayOf(1f, 0f, 1f, 1f, 0f, 0f, 0f, 1f)
      else -> QUAD_TEX_COORDS
    }
    videoTexCoords = floats(coords)
  }

  /** Draws the frame currently bound to the external texture, filling the output. */
  fun drawVideo(textureMatrix: FloatArray) {
    GLES20.glViewport(0, 0, width, height)
    GLES20.glDisable(GLES20.GL_BLEND)
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

    GLES20.glUseProgram(videoProgram)
    GLES20.glUniformMatrix4fv(
      GLES20.glGetUniformLocation(videoProgram, "uTextureMatrix"),
      1,
      false,
      textureMatrix,
      0,
    )
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, videoTextureId)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(videoProgram, "uTexture"), 0)

    drawQuad(videoProgram, videoVertices, videoTexCoords)
  }

  /** Replaces the overlay texture. Only called when the draw list actually changed. */
  fun uploadOverlay(bitmap: Bitmap) {
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, overlayTextureId)
    if (overlayUploaded) {
      GLUtils.texSubImage2D(GLES20.GL_TEXTURE_2D, 0, 0, 0, bitmap)
    } else {
      GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
      overlayUploaded = true
    }
  }

  /** Composites the overlay over the frame already drawn. */
  fun drawOverlay() {
    if (!overlayUploaded) return

    GLES20.glEnable(GLES20.GL_BLEND)
    // The bitmap arrives with its alpha already multiplied into its colours,
    // which is what Android's own compositing produces and what this expects.
    GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA)

    GLES20.glUseProgram(overlayProgram)
    // The overlay is already in the output's own coordinates, so it takes the
    // identity where the video takes the decoder's transform. Left unset, a
    // uniform is zero and the whole texture collapses to one corner texel.
    GLES20.glUniformMatrix4fv(
      GLES20.glGetUniformLocation(overlayProgram, "uTextureMatrix"),
      1,
      false,
      IDENTITY,
      0,
    )
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, overlayTextureId)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(overlayProgram, "uTexture"), 0)

    drawQuad(overlayProgram, videoVertices, overlayTexCoords)
    GLES20.glDisable(GLES20.GL_BLEND)
  }

  /** Stamps the frame with the time the encoder should give it, and hands it over. */
  fun present(presentationNs: Long) {
    EGLExt.eglPresentationTimeANDROID(display, surface, presentationNs)
    EGL14.eglSwapBuffers(display, surface)
  }

  fun release() {
    if (display != EGL14.EGL_NO_DISPLAY) {
      EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
      if (surface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(display, surface)
      if (context != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(display, context)
      EGL14.eglReleaseThread()
      EGL14.eglTerminate(display)
    }
    display = EGL14.EGL_NO_DISPLAY
    context = EGL14.EGL_NO_CONTEXT
    surface = EGL14.EGL_NO_SURFACE
  }

  private fun drawQuad(program: Int, positions: FloatBuffer, texCoords: FloatBuffer) {
    val position = GLES20.glGetAttribLocation(program, "aPosition")
    val texCoord = GLES20.glGetAttribLocation(program, "aTexCoord")

    positions.position(0)
    GLES20.glVertexAttribPointer(position, 2, GLES20.GL_FLOAT, false, 0, positions)
    GLES20.glEnableVertexAttribArray(position)

    texCoords.position(0)
    GLES20.glVertexAttribPointer(texCoord, 2, GLES20.GL_FLOAT, false, 0, texCoords)
    GLES20.glEnableVertexAttribArray(texCoord)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

    GLES20.glDisableVertexAttribArray(position)
    GLES20.glDisableVertexAttribArray(texCoord)
  }

  private fun setUpEgl(encoderSurface: Surface) {
    display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    if (display == EGL14.EGL_NO_DISPLAY) throw GlException("no EGL display")

    val version = IntArray(2)
    if (!EGL14.eglInitialize(display, version, 0, version, 1)) throw GlException("EGL would not start")

    val attributes = intArrayOf(
      EGL14.EGL_RED_SIZE, 8,
      EGL14.EGL_GREEN_SIZE, 8,
      EGL14.EGL_BLUE_SIZE, 8,
      EGL14.EGL_ALPHA_SIZE, 8,
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
      // Without this the encoder's surface is not a valid EGL window.
      EGL_RECORDABLE_ANDROID, 1,
      EGL14.EGL_NONE,
    )
    val configs = arrayOfNulls<EGLConfig>(1)
    val configCount = IntArray(1)
    if (!EGL14.eglChooseConfig(display, attributes, 0, configs, 0, 1, configCount, 0) ||
      configCount[0] == 0
    ) {
      throw GlException("this phone offers no recordable EGL config")
    }

    context = EGL14.eglCreateContext(
      display,
      configs[0],
      EGL14.EGL_NO_CONTEXT,
      intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE),
      0,
    )
    if (context == EGL14.EGL_NO_CONTEXT) throw GlException("no GL context")

    surface = EGL14.eglCreateWindowSurface(
      display,
      configs[0],
      encoderSurface,
      intArrayOf(EGL14.EGL_NONE),
      0,
    )
    if (surface == EGL14.EGL_NO_SURFACE) throw GlException("the encoder surface was refused")

    if (!EGL14.eglMakeCurrent(display, surface, surface, context)) {
      throw GlException("the GL context would not attach")
    }
  }

  private fun createTexture(target: Int): Int {
    val ids = IntArray(1)
    GLES20.glGenTextures(1, ids, 0)
    GLES20.glBindTexture(target, ids[0])
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    return ids[0]
  }

  private fun buildProgram(vertex: String, fragment: String): Int {
    val program = GLES20.glCreateProgram()
    GLES20.glAttachShader(program, compile(GLES20.GL_VERTEX_SHADER, vertex))
    GLES20.glAttachShader(program, compile(GLES20.GL_FRAGMENT_SHADER, fragment))
    GLES20.glLinkProgram(program)

    val linked = IntArray(1)
    GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linked, 0)
    if (linked[0] == 0) {
      val log = GLES20.glGetProgramInfoLog(program)
      GLES20.glDeleteProgram(program)
      throw GlException("shader link failed: $log")
    }
    return program
  }

  private fun compile(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)

    val compiled = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
    if (compiled[0] == 0) {
      val log = GLES20.glGetShaderInfoLog(shader)
      GLES20.glDeleteShader(shader)
      throw GlException("shader compile failed: $log")
    }
    return shader
  }

  private fun floats(values: FloatArray): FloatBuffer =
    ByteBuffer.allocateDirect(values.size * 4)
      .order(ByteOrder.nativeOrder())
      .asFloatBuffer()
      .apply {
        put(values)
        position(0)
      }

  private companion object {
    const val EGL_RECORDABLE_ANDROID = 0x3142

    val IDENTITY = floatArrayOf(
      1f, 0f, 0f, 0f,
      0f, 1f, 0f, 0f,
      0f, 0f, 1f, 0f,
      0f, 0f, 0f, 1f,
    )

    /** A triangle strip covering the whole output. */
    val QUAD_POSITIONS = floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)
    val QUAD_TEX_COORDS = floatArrayOf(0f, 0f, 1f, 0f, 0f, 1f, 1f, 1f)

    /**
     * The overlay is a bitmap, which starts at the top left, while GL texture
     * coordinates start at the bottom left. These are the video's flipped once.
     */
    val OVERLAY_TEX_COORDS = floatArrayOf(0f, 1f, 1f, 1f, 0f, 0f, 1f, 0f)

    val VERTEX_SHADER = """
      attribute vec4 aPosition;
      attribute vec4 aTexCoord;
      uniform mat4 uTextureMatrix;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = aPosition;
        vTexCoord = (uTextureMatrix * aTexCoord).xy;
      }
    """.trimIndent()

    val VIDEO_FRAGMENT_SHADER = """
      #extension GL_OES_EGL_image_external : require
      precision mediump float;
      varying vec2 vTexCoord;
      uniform samplerExternalOES uTexture;
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    """.trimIndent()

    val OVERLAY_FRAGMENT_SHADER = """
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    """.trimIndent()
  }
}
