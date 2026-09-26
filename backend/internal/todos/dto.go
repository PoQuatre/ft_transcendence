package todos

type CreateInput struct {
	Title string `json:"title"`
}

type UpdateInput struct {
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}
