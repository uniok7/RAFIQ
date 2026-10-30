import { Redirect } from 'expo-router';

// Entry route. The root layout's guard bounces to /onboarding when there's no session.
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
