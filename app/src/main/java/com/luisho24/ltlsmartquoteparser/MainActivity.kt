package com.luisho24.ltlsmartquoteparser

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.text.HtmlCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.luisho24.ltlsmartquoteparser.databinding.ActivityMainBinding
import com.luisho24.ltlsmartquoteparser.overlay.OverlayBubbleService
import com.luisho24.ltlsmartquoteparser.parser.P1QuoteParser
import com.luisho24.ltlsmartquoteparser.parser.ParsedQuote
import org.jsoup.Jsoup

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var rateAdapter: RateAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        rateAdapter = RateAdapter()
        binding.ratesRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.ratesRecyclerView.adapter = rateAdapter

        val sortOptions = listOf("Cheapest", "Fastest")
        binding.sortSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, sortOptions)
        updateOverlayStatus()

        binding.parseButton.setOnClickListener {
            parseCurrentQuote()
        }

        binding.clearButton.setOnClickListener {
            binding.quoteInput.text?.clear()
            renderQuote(null)
        }

        binding.pasteButton.setOnClickListener {
            val text = getBestClipboardText()
            if (text.isNotBlank()) {
                binding.quoteInput.setText(text)
                Toast.makeText(this, "Quote pasted from clipboard", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Clipboard is empty", Toast.LENGTH_SHORT).show()
            }
        }

        binding.copyButton.setOnClickListener {
            val output = buildShareText()
            if (output.isBlank()) {
                Toast.makeText(this, "Nothing to copy yet", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("rates", output))
            Toast.makeText(this, "Rates copied to clipboard", Toast.LENGTH_SHORT).show()
        }

        binding.shareButton.setOnClickListener {
            val output = buildShareText()
            if (output.isBlank()) {
                Toast.makeText(this, "Nothing to share yet", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, output)
            }
            startActivity(Intent.createChooser(intent, "Share rates"))
        }

        binding.enableOverlayButton.setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                ContextCompat.startForegroundService(this, Intent(this, OverlayBubbleService::class.java))
                updateOverlayStatus()
                Toast.makeText(this, "Floating bubble enabled", Toast.LENGTH_SHORT).show()
            } else {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivity(intent)
            }
        }

        binding.disableOverlayButton.setOnClickListener {
            stopService(Intent(this, OverlayBubbleService::class.java))
            updateOverlayStatus()
            Toast.makeText(this, "Floating bubble disabled", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        updateOverlayStatus()
    }

    private fun parseCurrentQuote() {
        val rawText = binding.quoteInput.text?.toString().orEmpty()
        if (rawText.isBlank()) {
            Toast.makeText(this, "Paste a quote first", Toast.LENGTH_SHORT).show()
            return
        }

        val parsed = P1QuoteParser.parse(rawText)
        val sortMode = binding.sortSpinner.selectedItem?.toString() ?: "Cheapest"
        val sortedRates = when (sortMode) {
            "Fastest" -> parsed.rates.sortedWith(compareBy({ it.numericTransitDays ?: Int.MAX_VALUE }, { it.cost }))
            else -> parsed.rates.sortedBy { it.cost }
        }
        renderQuote(parsed.copy(rates = sortedRates))
    }

    private fun renderQuote(parsedQuote: ParsedQuote?) {
        if (parsedQuote == null) {
            binding.quoteIdValue.text = "-"
            binding.originValue.text = "-"
            binding.destinationValue.text = "-"
            binding.itemsValue.text = "-"
            binding.emptyStateText.text = "Paste quote text and tap Parse Quote Data"
            rateAdapter.submitList(emptyList())
            return
        }

        binding.quoteIdValue.text = parsedQuote.id.ifBlank { "-" }
        binding.originValue.text = parsedQuote.from.ifBlank { "-" }
        binding.destinationValue.text = parsedQuote.to.ifBlank { "-" }
        binding.itemsValue.text = if (parsedQuote.items.isEmpty()) "-" else parsedQuote.items.joinToString("\n") { it.text }
        binding.emptyStateText.text = if (parsedQuote.rates.isEmpty()) "No rates found" else ""
        binding.resultsCountValue.text = "${parsedQuote.rates.size} rates"
        rateAdapter.submitList(parsedQuote.rates)
    }

    private fun updateOverlayStatus() {
        val enabled = Settings.canDrawOverlays(this)
        binding.overlayStatusValue.text = if (enabled) "Overlay permission granted" else "Overlay permission required"
    }

    private fun getBestClipboardText(): String {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val item = clipboard.primaryClip?.getItemAt(0) ?: return ""

        item.htmlText?.let { html ->
            val parsed = parseClipboardHtml(html)
            if (parsed.isNotBlank()) return parsed
        }

        val plain = item.coerceToText(this)?.toString().orEmpty()
        return plain
    }

    private fun parseClipboardHtml(html: String): String {
        return try {
            val doc = Jsoup.parseBodyFragment(html)
            val rows = doc.select("tr")
            if (rows.isNotEmpty()) {
                rows.joinToString("\n") { row ->
                    row.select("th,td").joinToString("\t") { cell -> cell.text().trim() }
                }
            } else {
                HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_LEGACY).toString()
            }
        } catch (_: Exception) {
            HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_LEGACY).toString()
        }
    }

    private fun buildShareText(): String {
        val rates = rateAdapter.currentItems
        if (rates.isEmpty()) return ""
        return rates.joinToString("\n") {
            "${it.normalizedCarrier} | ${'$'}${"%.2f".format(it.cost)} | ${it.transitDays} days | ${it.service}"
        }
    }
}
