package expo.modules.scaleocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ScaleOcrRecognitionException(message: String, cause: Throwable?) :
  CodedException("ERR_SCALE_OCR_FAILED", message, cause)

class ScaleOcrModule : Module() {
  private var recognizer: TextRecognizer? = null

  private fun client(): TextRecognizer {
    return recognizer ?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also {
      recognizer = it
    }
  }

  private fun symbolMap(symbol: Text.Symbol): Map<String, Any?> = mapOf(
    "text" to symbol.text,
    "confidence" to symbol.confidence.toDouble(),
  )

  private fun elementMap(element: Text.Element): Map<String, Any?> = mapOf(
    "text" to element.text,
    "confidence" to element.confidence.toDouble(),
    "symbols" to element.symbols.map { symbolMap(it) },
  )

  private fun lineMap(line: Text.Line): Map<String, Any?> {
    val box = line.boundingBox
    return mapOf(
      "text" to line.text,
      "confidence" to line.confidence.toDouble(),
      "elements" to line.elements.map { elementMap(it) },
      "frame" to box?.let {
        mapOf("left" to it.left, "top" to it.top, "width" to it.width(), "height" to it.height())
      },
    )
  }

  private fun recognize(image: InputImage): Map<String, Any?> {
    val result = try {
      Tasks.await(client().process(image), 10, TimeUnit.SECONDS)
    } catch (e: Exception) {
      throw ScaleOcrRecognitionException(e.message ?: "OCR failed", e)
    }
    val lines = result.textBlocks.flatMap { block -> block.lines.map { lineMap(it) } }
    return mapOf("text" to result.text, "lines" to lines)
  }

  private fun readOrientation(uri: Uri): Int {
    val context = appContext.reactContext ?: return ExifInterface.ORIENTATION_NORMAL
    return try {
      context.contentResolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } ?: ExifInterface.ORIENTATION_NORMAL
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
  }

  private fun orientationMatrix(orientation: Int): Matrix? {
    val m = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
      else -> return null
    }
    return m
  }

  /**
   * Crops the normalized guide-box region out of a captured frame, scales it to [targetWidth],
   * converts it to contrast-stretched grayscale, runs ML Kit on the enhanced image and returns
   * both the OCR result and the grayscale pixels (base64) for the JS seven-segment decoder.
   */
  private fun processFrame(
    uriString: String,
    cropX: Double,
    cropY: Double,
    cropW: Double,
    cropH: Double,
    targetWidth: Int,
  ): Map<String, Any?> {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val uri = Uri.parse(uriString)
    val started = System.currentTimeMillis()

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw ScaleOcrRecognitionException("Unable to read camera frame", null)
    }

    val orientation = readOrientation(uri)
    val swapsAxes = orientation in listOf(
      ExifInterface.ORIENTATION_ROTATE_90,
      ExifInterface.ORIENTATION_ROTATE_270,
      ExifInterface.ORIENTATION_TRANSPOSE,
      ExifInterface.ORIENTATION_TRANSVERSE,
    )
    val orientedW = if (swapsAxes) bounds.outHeight else bounds.outWidth
    val safeTarget = targetWidth.coerceIn(160, 1280)
    val cropPixelsW = max(1.0, cropW.coerceIn(0.01, 1.0) * orientedW)
    var sample = 1
    while (cropPixelsW / (sample * 2) >= safeTarget) sample *= 2

    val decoded = context.contentResolver.openInputStream(uri)?.use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: throw ScaleOcrRecognitionException("Unable to decode camera frame", null)

    val matrix = orientationMatrix(orientation)
    val oriented = if (matrix != null) {
      Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also {
        if (it != decoded) decoded.recycle()
      }
    } else decoded

    val x0 = (cropX.coerceIn(0.0, 1.0) * oriented.width).roundToInt().coerceIn(0, oriented.width - 1)
    val y0 = (cropY.coerceIn(0.0, 1.0) * oriented.height).roundToInt().coerceIn(0, oriented.height - 1)
    val w = (cropW.coerceIn(0.0, 1.0) * oriented.width).roundToInt().coerceIn(1, oriented.width - x0)
    val h = (cropH.coerceIn(0.0, 1.0) * oriented.height).roundToInt().coerceIn(1, oriented.height - y0)
    val cropped = Bitmap.createBitmap(oriented, x0, y0, w, h)
    if (cropped != oriented) oriented.recycle()

    val outW = min(safeTarget, max(1, cropped.width * 2))
    val outH = max(1, (cropped.height.toDouble() * outW / cropped.width).roundToInt())
    val scaled = Bitmap.createScaledBitmap(cropped, outW, outH, true)
    if (scaled != cropped) cropped.recycle()

    val pixels = IntArray(outW * outH)
    scaled.getPixels(pixels, 0, outW, 0, 0, outW, outH)
    scaled.recycle()

    val gray = ByteArray(pixels.size)
    val histogram = IntArray(256)
    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16) and 0xff
      val g = (p shr 8) and 0xff
      val b = p and 0xff
      val l = ((r * 299 + g * 587 + b * 114) / 1000).coerceIn(0, 255)
      gray[i] = l.toByte()
      histogram[l]++
    }
    val lowCut = pixels.size * 0.02
    val highCut = pixels.size * 0.98
    var acc = 0
    var lo = 0
    var hi = 255
    for (v in 0..255) {
      acc += histogram[v]
      if (acc >= lowCut) { lo = v; break }
    }
    acc = 0
    for (v in 0..255) {
      acc += histogram[v]
      if (acc >= highCut) { hi = v; break }
    }
    val range = max(1, hi - lo)
    for (i in gray.indices) {
      val v = gray[i].toInt() and 0xff
      val stretched = (((v - lo) * 255) / range).coerceIn(0, 255)
      gray[i] = stretched.toByte()
      pixels[i] = (0xff shl 24) or (stretched shl 16) or (stretched shl 8) or stretched
    }

    val enhanced = Bitmap.createBitmap(pixels, outW, outH, Bitmap.Config.ARGB_8888)
    val ocr = try {
      recognize(InputImage.fromBitmap(enhanced, 0))
    } finally {
      enhanced.recycle()
    }

    return ocr + mapOf(
      "gray" to Base64.encodeToString(gray, Base64.NO_WRAP),
      "width" to outW,
      "height" to outH,
      "processingMs" to (System.currentTimeMillis() - started).toInt(),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("ScaleOcr")

    AsyncFunction("recognizeAsync") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        throw ScaleOcrRecognitionException("Unable to read image for OCR", e)
      }
      recognize(image)
    }

    AsyncFunction("processFrameAsync") { uri: String, cropX: Double, cropY: Double, cropW: Double, cropH: Double, targetWidth: Int ->
      processFrame(uri, cropX, cropY, cropW, cropH, targetWidth)
    }

    OnDestroy {
      recognizer?.close()
      recognizer = null
    }
  }
}
