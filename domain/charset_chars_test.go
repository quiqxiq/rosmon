package domain

import (
	"strings"
	"testing"
)

func TestCharset_Chars(t *testing.T) {
	t.Parallel()

	cases := []struct {
		c           Charset
		minLen      int
		mustNotHave string
		mustHave    string
	}{
		{CharsetLower, 20, "ilo01", "abcxyz"},
		{CharsetUpper, 20, "IO01", "ABCXYZ"},
		{CharsetMixed, 40, "ilo01IO", "abcXYZ"},
		{CharsetNumber, 5, "01", "23456789"},
		{CharsetLowNum, 25, "ilo01IO", "abc23"},
		{CharsetUpNum, 25, "IO01ilo", "ABC23"},
		{CharsetMixNum, 45, "ilo01IO", "abcXYZ23"},
	}
	for _, tc := range cases {
		t.Run(string(tc.c), func(t *testing.T) {
			got := tc.c.Chars()
			if len(got) < tc.minLen {
				t.Errorf("len(%q) = %d, want >= %d", got, len(got), tc.minLen)
			}
			for _, r := range tc.mustNotHave {
				if strings.ContainsRune(got, r) {
					t.Errorf("charset %s should NOT contain %q", tc.c, string(r))
				}
			}
			for _, r := range tc.mustHave {
				if !strings.ContainsRune(got, r) {
					t.Errorf("charset %s should contain %q", tc.c, string(r))
				}
			}
		})
	}
}

func TestCharset_Chars_invalid(t *testing.T) {
	if got := Charset("nope").Chars(); got != "" {
		t.Errorf("invalid charset Chars() = %q, want empty", got)
	}
}
