package be.sportgreenmoove.app.domain

class BookingReplyUnconfirmedException(cause: Throwable) : IllegalStateException("Booking reply unconfirmed", cause)
