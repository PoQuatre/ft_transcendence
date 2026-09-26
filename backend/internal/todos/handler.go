package todos

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

func RegisterRoutes(group *echo.Group, service *Service) {
	h := handler{service: service}
	group.GET("", h.list)
	group.POST("", h.create)
	group.GET("/:id", h.get)
	group.PUT("/:id", h.update)
	group.DELETE("/:id", h.delete)
}

type handler struct {
	service *Service
}

func (h handler) list(c *echo.Context) error {
	todos, err := h.service.List(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, todos)
}

func (h handler) get(c *echo.Context) error {
	id, err := idFrom(c)
	if err != nil {
		return err
	}
	todo, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, todo)
}

func (h handler) create(c *echo.Context) error {
	var input CreateInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid JSON")
	}
	todo, err := h.service.Create(c.Request().Context(), input)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusCreated, todo)
}

func (h handler) update(c *echo.Context) error {
	id, err := idFrom(c)
	if err != nil {
		return err
	}
	var input UpdateInput
	if err = c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid JSON")
	}
	todo, err := h.service.Update(c.Request().Context(), id, input)
	if err != nil {
		return apiError(err)
	}
	return c.JSON(http.StatusOK, todo)
}

func (h handler) delete(c *echo.Context) error {
	id, err := idFrom(c)
	if err != nil {
		return err
	}
	if err := h.service.Delete(c.Request().Context(), id); err != nil {
		return apiError(err)
	}
	return c.NoContent(http.StatusNoContent)
}

func idFrom(c *echo.Context) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "invalid todo ID")
	}
	return id, nil
}

func apiError(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, ErrInvalidTitle):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	default:
		return err
	}
}
