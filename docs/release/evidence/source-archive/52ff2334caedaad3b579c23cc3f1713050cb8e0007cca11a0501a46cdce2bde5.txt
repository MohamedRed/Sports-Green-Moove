package be.sportgreenmoove.app.domain

class BookingReviewRequiredException(cause: Throwable? = null) : IllegalStateException("Booking review required", cause)
