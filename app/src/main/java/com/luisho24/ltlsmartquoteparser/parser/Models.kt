package com.luisho24.ltlsmartquoteparser.parser

data class QuoteItem(
    val text: String,
    val isSub: Boolean = false
)

data class QuoteRate(
    val carrier: String,
    val normalizedCarrier: String,
    val cost: Double,
    val quoteNumber: String,
    val liability: String,
    val service: String,
    val transitDays: String,
    val rateType: String,
    val numericTransitDays: Int? = transitDays.toIntOrNull()
)

data class ParsedQuote(
    val id: String,
    val from: String,
    val to: String,
    val items: List<QuoteItem>,
    val accessorials: List<String>,
    val rates: List<QuoteRate>
)
