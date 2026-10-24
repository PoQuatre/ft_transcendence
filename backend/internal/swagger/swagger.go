// Package swagger creates the swagger documentation for the API.
package swagger

import (
	_ "embed"
	"net/http"

	"github.com/labstack/echo/v5"
	swaggerFiles "github.com/swaggo/files"

	"github.com/PoQuatre/ft_transcendence/backend/docs"
)

//go:embed index.html
var indexHTML []byte

func RegisterRoutes(e *echo.Echo) {
	e.GET("/swagger", func(c *echo.Context) error {
		return c.Redirect(http.StatusFound, "/swagger/index.html")
	})

	e.GET("/swagger/index.html", func(c *echo.Context) error {
		return c.HTMLBlob(http.StatusOK, indexHTML)
	})

	e.GET("/swagger/doc.json", func(c *echo.Context) error {
		return c.Blob(http.StatusOK, "application/json; charset=utf-8", []byte(docs.SwaggerInfo.ReadDoc()))
	})

	e.GET("/swagger/*", func(c *echo.Context) error {
		c.Request().URL.Path = "/" + c.Param("*")
		swaggerFiles.Handler.ServeHTTP(c.Response(), c.Request())
		return nil
	})
}
