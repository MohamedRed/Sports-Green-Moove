package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.MultiParagraph
import androidx.compose.ui.text.MultiParagraphIntrinsics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Constraints
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import kotlin.math.ceil

internal fun reportedTextLayout(node: SemanticsNodeInteraction): TextLayoutResult {
    val layouts = mutableListOf<TextLayoutResult>()
    node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
    assertEquals(1, layouts.size)
    return layouts.single()
}

internal fun assertMeasuredTextFits(reported: TextLayoutResult): MultiParagraph {
    val input = reported.layoutInput
    assertTrue(input.softWrap)
    // String semantics reconstruct a wider paragraph; use the actual measured node width.
    val measured = MultiParagraph(
        intrinsics = MultiParagraphIntrinsics(input.text, input.style, input.placeholders, input.density, input.fontFamilyResolver),
        constraints = Constraints(maxWidth = reported.size.width), maxLines = input.maxLines, overflow = input.overflow,
    )
    assertTrue("Text exceeds its measured height", ceil(measured.height).toInt() <= reported.size.height)
    assertTrue("Text exceeds its line limit", !measured.didExceedMaxLines)
    assertTrue(measured.lineCount > 0)
    assertEquals("The measured frame must retain the whole label", input.text.length, measured.getLineEnd(measured.lineCount - 1))
    for (line in 0 until measured.lineCount) {
        assertTrue("Text extends beyond its left edge", measured.getLineLeft(line) >= 0f)
        assertTrue("Text extends beyond its right edge", measured.getLineRight(line) <= reported.size.width)
    }
    return measured
}
