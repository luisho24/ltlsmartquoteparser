package com.luisho24.ltlsmartquoteparser.parser

object P1QuoteParser {

    fun parse(rawInput: String): ParsedQuote {
        val normalizedInput = rawInput.replace('⠀', '\t')
        val lines = normalizedInput.lines().map { it.trim() }.filter { it.isNotBlank() }

        var quoteId = ""
        var from = ""
        var to = ""
        val items = mutableListOf<QuoteItem>()
        val accessorials = mutableListOf<String>()
        val rates = mutableListOf<QuoteRate>()

        var mode = "header"
        var currentRateType = "LTL"

        lines.forEach { line ->
            val lower = line.lowercase()

            when {
                lower == "accessorials:" || lower == "accessorials" -> {
                    mode = "accessorials"
                    return@forEach
                }
                lower == "items:" || lower == "items" || lower.startsWith("items / pallets") -> {
                    mode = "items"
                    return@forEach
                }
                lower.contains("ltl rates") -> {
                    mode = "rates"
                    currentRateType = "LTL"
                    return@forEach
                }
                lower.contains("volume rates") -> {
                    mode = "rates"
                    currentRateType = "Volume"
                    return@forEach
                }
            }

            when (mode) {
                "header" -> {
                    when {
                        lower.startsWith("quote id:") -> quoteId = line.substringAfter(":").trim()
                        lower.startsWith("from:") -> from = line.substringAfter(":").trim()
                        lower.startsWith("to:") -> to = line.substringAfter(":").trim()
                    }
                }
                "accessorials" -> {
                    if (!line.contains('$')) {
                        accessorials.add(line)
                    }
                }
                "items" -> {
                    if (line.contains("Pallet") || line.contains("Skid") || line.contains("Crate") || line.contains("Box")) {
                        items.add(QuoteItem(text = line))
                    }
                }
                "rates" -> {
                    if (lower.contains("customer rate") || lower.contains("transit days") || lower.startsWith("carrier")) {
                        return@forEach
                    }
                    parseTabRateLine(line, currentRateType)?.let { rates.add(it) }
                }
            }
        }

        return ParsedQuote(
            id = quoteId,
            from = from,
            to = to,
            items = items,
            accessorials = accessorials,
            rates = rates
        )
    }

    private fun parseTabRateLine(line: String, rateType: String): QuoteRate? {
        val cols = line.split('\t').map { normalizeText(it) }.filter { it.isNotBlank() }
        if (cols.size < 5 || cols.none { it.contains('$') }) return null

        val carrier = cols.firstOrNull().orEmpty()
        val customerRate = cols.firstOrNull { Regex("^\\$[0-9,.]+$").matches(it) }
            ?.replace("$", "")
            ?.replace(",", "")
            ?.toDoubleOrNull()
            ?: return null

        val quoteNumber = cols.firstOrNull { it.any(Char::isDigit) && !it.contains('$') && !it.contains('/') && it != carrier }
            ?.takeIf { !isServiceLabel(it) }
            ?: "-"

        val liability = cols.firstOrNull { it.contains("/") && it.contains("$") }
            ?.replace("$", "")
            ?.replace(",", "")
            ?: "-"

        val service = cols.firstOrNull { isServiceLabel(it) } ?: "Standard"
        val transit = cols.lastOrNull { it.matches(Regex("^\\d{1,3}$")) || it.matches(Regex("^\\d{1,3}\\s*Days?$", RegexOption.IGNORE_CASE)) }
            ?.replace(Regex("\\s*Days?$", RegexOption.IGNORE_CASE), "")
            ?: "N/A"

        return QuoteRate(
            carrier = carrier,
            normalizedCarrier = normalizeCarrierName(carrier),
            cost = customerRate,
            quoteNumber = quoteNumber,
            liability = liability,
            service = service,
            transitDays = transit,
            rateType = rateType
        )
    }

    private fun normalizeText(value: String): String {
        return value
            .replace(Regex("[\\u00a0\\u2000-\\u200f\\u2028\\u2029\\u202f\\u205f\\u2060]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun isServiceLabel(value: String): Boolean {
        return Regex("(Standard Rate|Economy|Priority|LTL Standard Transit|Market Rate|Standard Service|Standard|Interline|TLX|TLS|EXCL|Guaranteed|One Rate One Time)", RegexOption.IGNORE_CASE)
            .containsMatchIn(value)
    }

    private fun normalizeCarrierName(name: String): String {
        val n = name.lowercase().trim()
        return when {
            n.contains("fedex") && n.contains("economy") -> "FedEx Economy"
            n.contains("fedex") && n.contains("priority") -> "FedEx Priority"
            n.contains("fedex") -> "FedEx"
            n.contains("forward") -> "Forward"
            n.contains("southeastern") || Regex("\\bsefl\\b").containsMatchIn(n) -> "Southeastern Freight"
            n.contains("old dominion") || Regex("\\bodfl\\b").containsMatchIn(n) -> "Old Dominion Freight Line"
            n.contains("central transport") -> "Central Transport"
            n.contains("dayton") -> "Dayton Freight Lines"
            n.contains("duie pyle") -> "A. Duie Pyle"
            n.contains("custom comp") -> "Custom Companies"
            n.contains("dohrn") -> "Dohrn Transfer"
            n.contains("magnum") -> "Magnum"
            n.contains("a & b") || n.contains("a&b") -> "A & B Freight Line"
            n.contains("double d") -> "Double D Express"
            n.contains("n&m") || n.contains("n & m") -> "N&M Transfer"
            n.contains("pitt ohio") -> "Pitt Ohio"
            n.contains("roadrunner") -> "Roadrunner"
            n.contains("tax air") -> "Tax Airfreight"
            n.contains("unis") -> "UNIS Transportation"
            n.contains("aaa cooper") -> "AAA Cooper"
            n.contains("averitt") -> "Averitt Express"
            n.contains("estes") -> "Estes"
            n.contains("dugan") -> "Dugan"
            Regex("\\bward\\b").containsMatchIn(n) -> "WARD Trucking"
            Regex("\\babf\\b").containsMatchIn(n) -> "ABF Freight"
            Regex("\\bxpo\\b").containsMatchIn(n) -> "XPO"
            Regex("\\btforce\\b").containsMatchIn(n) || n.contains("tforce") -> "TForce Freight"
            Regex("\\bsaia\\b").containsMatchIn(n) -> "Saia LTL Freight"
            Regex("\\br\\s*&\\s*l\\b").containsMatchIn(n) || n.contains("r and l") -> "R&L Carriers"
            else -> name.trim()
        }
    }
}
