import { Title } from '@solidjs/meta';

import AuthForm from '../components/AuthForm';

export default function Login() {
  return (
    <>
      <Title>Log in - Solid App</Title>
      <AuthForm mode="login" />
    </>
  );
}
