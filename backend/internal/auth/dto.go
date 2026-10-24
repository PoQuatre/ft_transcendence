package auth

type ResetPasswordRequest struct {
	Password string `json:"password" validate:"required,min=10,max=72,password_complexity" example:"S3curePass!"`
	Token    string `json:"token" validate:"required" example:"a1b2c3d4-e5f6-7890-abcd-1234567890ab"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"    validate:"required,min=3,max=998,email" example:"user@example.com"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"oldpassword" example:"OldPassword!"`
	NewPassword string `json:"newpassword" validate:"required,min=10,max=72,password_complexity" example:"NewS4fePass!"`
}

type MailVerificationRequest struct {
	Code string `json:"code" example:"123456"`
}

type SignupRequest struct {
	Username string `json:"username" validate:"required,min=3,max=30,username_chars" example:"Great_player"`
	Email    string `json:"email"    validate:"required,min=3,max=998,email" example:"great@example.com"`
	Password string `json:"password" validate:"required,min=10,max=72,password_complexity" example:"Gr34tPassw0rd!"`
}

type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email" example:"your@email.com"`
	Password string `json:"password"   validate:"required" example:"Y0urP4ssword?"`
}

type UserResponse struct {
	ID       string `json:"id" example:"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"`
	Username string `json:"username" example:"johndoe"`
	Email    string `json:"email" example:"john.doe@example.com"`
	Verified bool   `json:"verified" example:"true"`
}
