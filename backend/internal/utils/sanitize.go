package utils

import (
	"html"
	"strings"
)

func Sanitize(s string) string {
	return html.EscapeString(strings.TrimSpace(s))
}
