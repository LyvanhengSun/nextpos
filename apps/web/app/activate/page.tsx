import { CredentialsForm } from '../../components/auth/credentials-form';

export default function ActivatePage() {
  return (
    <CredentialsForm
      titleKey="auth.activateOwner"
      endpoint="activate-owner"
      successKey="auth.ownerAccessReady"
    />
  );
}
