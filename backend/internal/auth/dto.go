package auth

type SignupRequest struct {
	Username string `json:"username" validate:"required,min=3,max=30,username_chars"`
	Email    string `json:"email"    validate:"required,min=3,max=998,email"`
	Password string `json:"password" validate:"required,min=10,max=72,password_complexity"`
}

type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password"   validate:"required"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}
