package database

type StaticCredentialsSource struct {
	credentials Credentials
}

func NewStaticCredentialsSource(user, password string) *StaticCredentialsSource {
	return &StaticCredentialsSource{
		credentials: Credentials{
			User:       user,
			Password:   password,
			Generation: 1,
		},
	}
}

func (s *StaticCredentialsSource) DBCredentials() *Credentials {
	return &s.credentials
}

func (*StaticCredentialsSource) DBCredentialsChanged() <-chan struct{} {
	return nil
}
