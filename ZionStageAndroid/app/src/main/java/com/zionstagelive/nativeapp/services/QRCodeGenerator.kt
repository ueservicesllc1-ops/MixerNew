package com.zionstagelive.nativeapp.services

import android.graphics.Bitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

object QRCodeGenerator {
    fun generateQRCode(text: String, size: Int = 300): ImageBitmap? {
        return try {
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, size, size)
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    val color = if (bitMatrix.get(x, y)) android.graphics.Color.parseColor("#0F172A") else android.graphics.Color.WHITE
                    bitmap.setPixel(x, y, color)
                }
            }
            bitmap.asImageBitmap()
        } catch (_: Exception) {
            null
        }
    }
}
