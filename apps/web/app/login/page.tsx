import { CredentialsForm } from '../../components/auth/credentials-form';

export default function LoginPage() {
  return (
    <CredentialsForm
      title="Sign in"
      endpoint="login"
      success="Signed in."
    />
  );
}
