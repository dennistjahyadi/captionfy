package expo.modules.burnin

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.Typeface

/**
 * One frame's captions, painted.
 *
 * `android.graphics` is Skia with a JNI layer on top, and these are the same
 * font files the preview measured with, at the same sizes, drawn from the same
 * baselines. That is the whole reason the export can be trusted to match the
 * preview without a second layout: this file positions nothing.
 *
 * The order matters and is the preview's order: every box first as one pass,
 * then every word. A box is padded past its own word, so drawing each one
 * immediately before its word would paint over the neighbour.
 *
 * A face key names a file this module carries in its own assets, which the build
 * takes from the app's `assets/fonts` directory: one copy in the repository, and
 * therefore no way for the export to draw with a face the preview never saw.
 */
internal class CaptionPainter(private val assets: AssetManager) {
  private val typefaces = HashMap<String, Typeface?>()

  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeJoin = Paint.Join.ROUND
  }
  private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG)

  fun paint(bitmap: Bitmap, words: List<BurnWord>) {
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

    for (word in words) word.box?.let { box -> drawBox(canvas, word, box) }
    for (word in words) drawWord(canvas, word)
  }

  private fun drawBox(canvas: Canvas, word: BurnWord, box: BurnBox) {
    canvas.withWord(word) {
      boxPaint.color = box.color
      boxPaint.alpha = alphaOf(box.color, word.opacity)
      canvas.drawRoundRect(
        box.x,
        box.y,
        box.x + box.width,
        box.y + box.height,
        box.radius,
        box.radius,
        boxPaint,
      )
    }
  }

  private fun drawWord(canvas: Canvas, word: BurnWord) {
    val typeface = typefaceFor(word.face)

    canvas.withWord(word) {
      if (word.outlineWidth > 0f) {
        outline.typeface = typeface
        outline.textSize = word.size
        outline.color = word.outlineColor
        outline.alpha = alphaOf(word.outlineColor, word.opacity)
        // Doubled because a stroke is centred on the glyph outline and half of it
        // lands inside the letter. The draw list means the width that shows.
        outline.strokeWidth = word.outlineWidth * STROKE_CENTRING
        canvas.drawText(word.text, word.x, word.baseline, outline)
      }

      fill.typeface = typeface
      fill.textSize = word.size
      fill.color = word.color
      fill.alpha = alphaOf(word.color, word.opacity)
      canvas.drawText(word.text, word.x, word.baseline, fill)

      if (word.fill > 0f && word.fillColor != word.color) {
        // Karaoke: the part of the word already said, clipped to how much of it
        // that is. Clipped wide vertically so a descender is never cut off.
        canvas.save()
        canvas.clipRect(
          word.x,
          word.y - word.height,
          word.x + word.width * word.fill,
          word.y + word.height * 2f,
        )
        fill.color = word.fillColor
        fill.alpha = alphaOf(word.fillColor, word.opacity)
        canvas.drawText(word.text, word.x, word.baseline, fill)
        canvas.restore()
      }
    }
  }

  /** Scales about the centre of the word's box, as the preview's `origin` does. */
  private inline fun Canvas.withWord(word: BurnWord, draw: () -> Unit) {
    if (word.scale == 1f) {
      draw()
      return
    }

    save()
    scale(word.scale, word.scale, word.x + word.width / 2f, word.y + word.height / 2f)
    draw()
    restore()
  }

  /**
   * The face, or the platform's default.
   *
   * A missing file draws nothing at all in some renderers and tofu in others,
   * and captions in the wrong face are recoverable where captions with no glyphs
   * are not.
   */
  private fun typefaceFor(key: String): Typeface? =
    typefaces.getOrPut(key) {
      try {
        Typeface.createFromAsset(assets, "$key.ttf")
      } catch (_: Throwable) {
        null
      }
    }

  private fun alphaOf(color: Int, opacity: Float): Int =
    ((color ushr 24) * opacity.coerceIn(0f, 1f)).toInt().coerceIn(0, 255)

  private companion object {
    const val STROKE_CENTRING = 2f
  }
}
