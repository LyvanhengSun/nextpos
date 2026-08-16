import { CredentialsForm } from '../../components/auth/credentials-form';

export default function LoginPage() {
  return (
    <CredentialsForm
      titleKey="auth.signIn"
      endpoint="login"
      successKey="auth.signedIn"
    />
  );
}
