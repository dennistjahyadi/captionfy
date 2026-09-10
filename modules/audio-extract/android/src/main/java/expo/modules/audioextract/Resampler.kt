package expo.modules.audioextract

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.sin

/**
 * Band-limited sample rate conversion with a Hann-windowed sinc kernel.
 *
 * Whisper wants 16 kHz and phone video is usually 44.1 or 48 kHz, so almost every
 * clip is downsampled by roughly 3x. Plain linear interpolation folds everything
 * above 8 kHz back into the speech band, which is exactly the kind of confound
 * that would make a Stage 0 word error rate meaningless. This lowpasses at the
 * new Nyquist first, so the accuracy we measure belongs to the model.
 *
 * The kernel is tabulated once per call and read with linear interpolation,
 * because evaluating sin() per tap costs more than the decode itself.
 */
internal object Resampler {
  /** Sinc zero crossings kept on each side of the kernel centre. */
  private const val ZERO_CROSSINGS = 16

  /** Kernel table entries per input sample. */
  private const val TABLE_PRECISION = 512

  /**
   * Fraction of the new Nyquist the passband is allowed to reach. The remainder is
   * transition band, which keeps the finite kernel from ringing at the cutoff.
   */
  private const val ROLLOFF = 0.945

  fun resample(input: FloatArray, sourceRate: Int, targetRate: Int): FloatArray {
    require(sourceRate > 0 && targetRate > 0) { "Sample rates must be positive" }
    if (sourceRate == targetRate || input.isEmpty()) return input

    val ratio = targetRate.toDouble() / sourceRate.toDouble()
    val outputLength = floor(input.size * ratio).toInt()
    if (outputLength <= 0) return FloatArray(0)

    // Cutoff in cycles per input sample. Downsampling pulls it below the source
    // Nyquist; upsampling leaves the source band untouched.
    val cutoff = 0.5 * min(1.0, ratio) * ROLLOFF
    // Sinc zero crossings sit at multiples of 1 / (2 * cutoff) input samples.
    val halfWidth = ceil(ZERO_CROSSINGS / (2.0 * cutoff))

    val table = buildKernelTable(cutoff, halfWidth)
    val output = FloatArray(outputLength)

    for (i in 0 until outputLength) {
      val centre = i / ratio
      val first = ceil(centre - halfWidth).toInt()
      val last = floor(centre + halfWidth).toInt()

      var sum = 0.0
      var weightSum = 0.0
      for (j in first..last) {
        if (j < 0 || j >= input.size) continue
        val weight = lookup(table, abs(centre - j) * TABLE_PRECISION)
        sum += weight * input[j]
        weightSum += weight
      }
      // Normalising by the realised weights keeps gain flat even where the kernel
      // is clipped by the start or end of the clip.
      output[i] = if (weightSum != 0.0) (sum / weightSum).toFloat() else 0f
    }

    return output
  }

  private fun buildKernelTable(cutoff: Double, halfWidth: Double): DoubleArray {
    val size = ceil(halfWidth * TABLE_PRECISION).toInt() + 2
    val table = DoubleArray(size)
    for (i in 0 until size) {
      val x = i.toDouble() / TABLE_PRECISION
      table[i] = if (x > halfWidth) 0.0 else sinc(2.0 * cutoff * x) * hann(x / halfWidth)
    }
    return table
  }

  /** Linear read of the tabulated kernel at a fractional table position. */
  private fun lookup(table: DoubleArray, position: Double): Double {
    val index = position.toInt()
    if (index >= table.size - 1) return 0.0
    val fraction = position - index
    return table[index] + (table[index + 1] - table[index]) * fraction
  }

  private fun sinc(x: Double): Double {
    if (x == 0.0) return 1.0
    val piX = PI * x
    return sin(piX) / piX
  }

  private fun hann(x: Double): Double {
    if (x >= 1.0) return 0.0
    return 0.5 * (1.0 + cos(PI * x))
  }
}
