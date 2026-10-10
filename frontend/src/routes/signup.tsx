import { Title } from '@solidjs/meta';

import AuthForm from '../components/AuthForm';

export default function Signup() {
  return (
    <>
      <Title>Sign up - Solid App</Title>
      <AuthForm mode="signup" />
    </>
  );
}
