package expo.modules.burnin

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The draw list for a whole video, as JavaScript wrote it.
 *
 * Nothing in this file decides anything about how a caption looks. Every
 * position, size and colour was produced by `layoutCaptionFrame` in JS, measured
 * with the same Skia faces the preview used, at this export's own pixel size.
 * That is how the exported file and the preview stay the same picture
 * (invariant 2), and it is why this is a reader and not a layout engine.
 */
/**
 * A drop shadow.
 *
 * `blur` is the Gaussian sigma the preview's Skia blur mask was given. Android's
 * `BlurMaskFilter` takes a radius and converts it to a sigma itself, so the
 * painter converts back rather than passing the number straight through: the
 * same figure read as a radius would be a shadow nearly twice as soft in the
 * exported file, which is invariant 2 broken in the one place nobody would look.
 */
internal data class BurnShadow(
  val color: Int,
  val blur: Float,
  val dx: Float,
  val dy: Float,
)

internal data class BurnBox(
  val x: Float,
  val y: Float,
  val width: Float,
  val height: Float,
  val radius: Float,
  val color: Int,
  val shadow: BurnShadow?,
)

internal data class BurnWord(
  val text: String,
  val x: Float,
  val y: Float,
  val width: Float,
  val height: Float,
  val baseline: Float,
  val size: Float,
  val face: String,
  val color: Int,
  val fillColor: Int,
  /** 0..1 of the word's width already spoken. Karaoke clips to this. */
  val fill: Float,
  val opacity: Float,
  /** Uniform scale about the centre of the word's box. */
  val scale: Float,
  val outlineColor: Int,
  val outlineWidth: Float,
  val shadow: BurnShadow?,
  val box: BurnBox?,
)

/** A draw list and the moment it starts applying. It holds until the next one. */
internal data class BurnEntry(val tMs: Long, val plate: BurnBox?, val words: List<BurnWord>)

internal data class BurnPlan(
  val width: Int,
  val height: Int,
  val fps: Int,
  val durationMs: Long,
  val entries: List<BurnEntry>,
) {
  /** The entry showing at `tMs`, given the one showing now. Entries only move forward. */
  fun entryAt(tMs: Long, from: Int): Int {
    var index = from
    while (index + 1 < entries.size && entries[index + 1].tMs <= tMs) index += 1
    return index
  }
}

internal class PlanUnreadableException(cause: Throwable) :
  expo.modules.kotlin.exception.CodedException("The caption plan could not be read", cause)

internal object PlanReader {
  fun read(path: String): BurnPlan =
    try {
      parse(JSONObject(File(path).readText()))
    } catch (error: Throwable) {
      throw PlanUnreadableException(error)
    }

  private fun parse(json: JSONObject): BurnPlan {
    val entriesJson = json.getJSONArray("entries")
    val entries = ArrayList<BurnEntry>(entriesJson.length())
    for (index in 0 until entriesJson.length()) {
      val entry = entriesJson.getJSONObject(index)
      entries.add(
        BurnEntry(
          tMs = entry.getLong("tMs"),
          plate = box(entry.optJSONObject("plate")),
          words = words(entry.getJSONArray("words")),
        )
      )
    }

    return BurnPlan(
      width = json.getInt("width"),
      height = json.getInt("height"),
      fps = json.getInt("fps"),
      durationMs = json.getLong("durationMs"),
      entries = entries,
    )
  }

  private fun words(array: JSONArray): List<BurnWord> =
    (0 until array.length()).map { index ->
      val word = array.getJSONObject(index)
      BurnWord(
        text = word.getString("text"),
        x = word.getDouble("x").toFloat(),
        y = word.getDouble("y").toFloat(),
        width = word.getDouble("width").toFloat(),
        height = word.getDouble("height").toFloat(),
        baseline = word.getDouble("baseline").toFloat(),
        size = word.getDouble("size").toFloat(),
        face = word.getString("face"),
        color = parseColor(word.getString("color")),
        fillColor = parseColor(word.getString("fillColor")),
        fill = word.getDouble("fill").toFloat(),
        opacity = word.getDouble("opacity").toFloat(),
        scale = word.getDouble("scale").toFloat(),
        outlineColor = parseColor(word.getString("outlineColor")),
        outlineWidth = word.getDouble("outlineWidth").toFloat(),
        shadow = shadow(word.optJSONObject("shadow")),
        box = box(word.optJSONObject("box")),
      )
    }

  private fun box(json: JSONObject?): BurnBox? =
    json?.let {
      BurnBox(
        x = it.getDouble("x").toFloat(),
        y = it.getDouble("y").toFloat(),
        width = it.getDouble("width").toFloat(),
        height = it.getDouble("height").toFloat(),
        radius = it.getDouble("radius").toFloat(),
        color = parseColor(it.getString("color")),
        shadow = shadow(it.optJSONObject("shadow")),
      )
    }

  private fun shadow(json: JSONObject?): BurnShadow? =
    json?.let {
      BurnShadow(
        color = parseColor(it.getString("color")),
        blur = it.getDouble("blur").toFloat(),
        dx = it.getDouble("dx").toFloat(),
        dy = it.getDouble("dy").toFloat(),
      )
    }

  /**
   * A CSS colour as Android wants it.
   *
   * The style sheet writes what Skia parses, which is CSS Color 4: eight digits
   * mean `#RRGGBBAA`, alpha last. `Color.parseColor` reads `#AARRGGBB`, alpha
   * first, so handing it a transparent box would paint an opaque red one.
   */
  fun parseColor(value: String): Int {
    val hex = value.removePrefix("#")

    return when (hex.length) {
      6 -> (0xFF shl 24) or hex.substring(0, 6).toInt(16)
      8 -> {
        val rgb = hex.substring(0, 6).toInt(16)
        val alpha = hex.substring(6, 8).toInt(16)
        (alpha shl 24) or rgb
      }
      // Anything else is a colour this app never writes. White is visible, which
      // is what makes it the right thing to fail to.
      else -> (0xFF shl 24) or 0xFFFFFF
    }
  }
}
