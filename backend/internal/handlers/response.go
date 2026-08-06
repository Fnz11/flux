package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	jsoniter "github.com/json-iterator/go"
)

var jsonAPI = jsoniter.ConfigCompatibleWithStandardLibrary

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type PaginatedData struct {
	Items interface{} `json:"items"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

func writeJSON(c *gin.Context, code int, v interface{}) {
	buf, err := jsonAPI.Marshal(v)
	if err != nil {
		_ = c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.Data(code, "application/json; charset=utf-8", buf)
}

func SuccessResponse(c *gin.Context, data interface{}) {
	writeJSON(c, http.StatusOK, APIResponse{Success: true, Data: data})
}

func ErrorResponse(c *gin.Context, status int, message string) {
	writeJSON(c, status, APIResponse{Success: false, Error: message})
}

func PaginatedResponse(c *gin.Context, data interface{}, total int, page int, limit int) {
	writeJSON(c, http.StatusOK, APIResponse{
		Success: true,
		Data: PaginatedData{
			Items: data,
			Total: total,
			Page:  page,
			Limit: limit,
		},
	})
}

func IsValidWalletAddress(addr string) bool {
	return len(addr) >= 32 && len(addr) <= 44
}
