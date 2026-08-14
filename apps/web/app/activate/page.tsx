import { CredentialsForm } from '../../components/auth/credentials-form';

export default function ActivatePage() {
  return (
    <CredentialsForm
      title="Activate owner"
      endpoint="activate-owner"
      success="Owner access ready. Sign in next."
    />
  );
}
