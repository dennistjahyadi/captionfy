package expo.modules.burnin

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
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
 * The order matters and is the preview's order: the card under everything, then
 * every box as one pass, then every word. A box is padded past its own word, so
 * drawing each one immediately before its word would paint over the neighbour.
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
  private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG)

  fun paint(bitmap: Bitmap, entry: BurnEntry, watermark: BurnWatermark? = null) {
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

    // The card is behind the whole block and belongs to no word, so it takes no
    // word's opacity and no word's scale.
    entry.plate?.let { plate -> drawBox(canvas, plate, 1f) }

    for (word in entry.words) {
      word.box?.let { box -> canvas.withWord(word) { drawBox(canvas, box, word.opacity) } }
    }
    for (word in entry.words) drawWord(canvas, word)

    // Last, over everything. This bitmap is cleared and repainted whenever the
    // caption entry changes and reused in between, so drawing the mark here is
    // what puts it on every frame of the file.
    watermark?.let { mark -> drawWatermark(canvas, mark) }
  }

  /**
   * The mark: the icon's pills, then each line as shadow and glyphs.
   *
   * The same draws the preview's `Watermark` makes, in the same order, from the
   * same baselines, in the same faces at the same sizes — a pill goes through
   * the same `drawBox` a box highlight does. Everything was positioned by
   * `layoutWatermark` in JS against this export's canvas; nothing here decides
   * where any of it goes.
   */
  private fun drawWatermark(canvas: Canvas, mark: BurnWatermark) {
    for (pill in mark.pills) drawBox(canvas, pill, 1f)

    for (line in mark.lines) {
      val typeface = typefaceFor(line.face)

      line.shadow?.let { shadow ->
        shadowPaint.typeface = typeface
        shadowPaint.textSize = line.size
        shadowPaint.color = shadow.color
        shadowPaint.alpha = alphaOf(shadow.color, 1f)
        shadowPaint.maskFilter = blurFor(shadow.blur)
        canvas.drawText(line.text, line.x + shadow.dx, line.baseline + shadow.dy, shadowPaint)
        shadowPaint.maskFilter = null
      }

      fill.typeface = typeface
      fill.textSize = line.size
      fill.color = line.color
      fill.alpha = alphaOf(line.color, 1f)
      canvas.drawText(line.text, line.x, line.baseline, fill)
    }
  }

  private fun drawBox(canvas: Canvas, box: BurnBox, opacity: Float) {
    box.shadow?.let { shadow ->
      shadowPaint.color = shadow.color
      shadowPaint.alpha = alphaOf(shadow.color, opacity)
      shadowPaint.maskFilter = blurFor(shadow.blur)
      canvas.drawRoundRect(
        box.x + shadow.dx,
        box.y + shadow.dy,
        box.x + shadow.dx + box.width,
        box.y + shadow.dy + box.height,
        box.radius,
        box.radius,
        shadowPaint,
      )
      shadowPaint.maskFilter = null
    }

    boxPaint.color = box.color
    boxPaint.alpha = alphaOf(box.color, opacity)
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

  private fun drawWord(canvas: Canvas, word: BurnWord) {
    val typeface = typefaceFor(word.face)

    canvas.withWord(word) {
      word.shadow?.let { shadow ->
        // A drop shadow is the word again, offset, blurred and in one colour —
        // the same two draws the preview makes, rather than `setShadowLayer`,
        // which would also shadow the outline pass below it.
        shadowPaint.typeface = typeface
        shadowPaint.textSize = word.size
        shadowPaint.color = shadow.color
        shadowPaint.alpha = alphaOf(shadow.color, word.opacity)
        shadowPaint.maskFilter = blurFor(shadow.blur)
        canvas.drawText(word.text, word.x + shadow.dx, word.baseline + shadow.dy, shadowPaint)
        shadowPaint.maskFilter = null
      }

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

  /**
   * The blur the preview used, as a radius.
   *
   * The plan carries a Gaussian sigma, because that is what Skia's blur mask
   * takes and the preview is Skia. `BlurMaskFilter` takes a radius and applies
   * Skia's own `radius * 0.57735 + 0.5` to reach a sigma, so this is that
   * conversion run backwards. Below half a pixel of sigma there is no radius
   * that produces it, and a shadow that soft is a hard one anyway.
   */
  private fun blurFor(sigma: Float): BlurMaskFilter? {
    val radius = (sigma - SIGMA_BIAS) / SIGMA_PER_RADIUS
    if (radius <= 0f) return null
    return blurs.getOrPut(radius) { BlurMaskFilter(radius, BlurMaskFilter.Blur.NORMAL) }
  }

  /** Mask filters are immutable and a clip holds one blur for its whole length. */
  private val blurs = HashMap<Float, BlurMaskFilter>()

  private companion object {
    const val STROKE_CENTRING = 2f
    const val SIGMA_PER_RADIUS = 0.57735f
    const val SIGMA_BIAS = 0.5f
  }
}
