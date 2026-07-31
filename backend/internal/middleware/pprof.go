package middleware

import (
	"net/http"
	"net/http/pprof"

	"github.com/gin-gonic/gin"
)

func RegisterPprof(r *gin.Engine) {
	g := r.Group("/debug/pprof")
	g.GET("/", gin.WrapH(http.HandlerFunc(pprof.Index)))
	g.GET("/heap", gin.WrapH(pprof.Handler("heap")))
	g.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))
	g.GET("/block", gin.WrapH(pprof.Handler("block")))
	g.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))
}
