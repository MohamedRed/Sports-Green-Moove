package be.sportgreenmoove.app.data

data class ReceivedRatingSummary(val userId: String, val count: Long, val average: Double?) {
    init {
        require(userId.isNotBlank() && count in 0..9_007_199_254_740_991L)
        require(if (count == 0L) average == null else average != null && average.isFinite() && average in 1.0..5.0)
    }
}
