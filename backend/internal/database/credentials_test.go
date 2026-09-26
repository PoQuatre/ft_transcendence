package database

import "testing"

func TestStaticCredentialsSource(t *testing.T) {
	source := NewStaticCredentialsSource("migration", "password")

	if got, want := source.DBCredentials(), (&Credentials{
		User:       "migration",
		Password:   "password",
		Generation: 1,
	}); *got != *want {
		t.Errorf("DBCredentials() = %+v, want %+v", got, want)
	}

	if changed := source.DBCredentialsChanged(); changed != nil {
		t.Error("DBCredentialsChanged() is not nil")
	}
}
