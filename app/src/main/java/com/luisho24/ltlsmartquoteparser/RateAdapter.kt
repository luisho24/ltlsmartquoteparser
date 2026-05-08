package com.luisho24.ltlsmartquoteparser

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.luisho24.ltlsmartquoteparser.databinding.ItemRateBinding
import com.luisho24.ltlsmartquoteparser.parser.QuoteRate

class RateAdapter : RecyclerView.Adapter<RateAdapter.RateViewHolder>() {

    var currentItems: List<QuoteRate> = emptyList()
        private set

    fun submitList(items: List<QuoteRate>) {
        currentItems = items
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RateViewHolder {
        val binding = ItemRateBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return RateViewHolder(binding)
    }

    override fun onBindViewHolder(holder: RateViewHolder, position: Int) {
        holder.bind(currentItems[position])
    }

    override fun getItemCount(): Int = currentItems.size

    class RateViewHolder(private val binding: ItemRateBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(rate: QuoteRate) {
            binding.carrierName.text = rate.normalizedCarrier
            binding.rateValue.text = "${'$'}${"%.2f".format(rate.cost)}"
            binding.transitValue.text = if (rate.transitDays == "N/A") "N/A" else "${rate.transitDays} day(s)"
            binding.serviceValue.text = rate.service
            binding.liabilityValue.text = rate.liability
            binding.rateTypeChip.text = rate.rateType
        }
    }
}
