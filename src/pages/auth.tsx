import { View } from "reshaped";
import SignInFlow from "@/components/SignInFlow";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function AuthPage() {
  return (
    <View
      height="100vh"
      direction="column"
      align="center"
      justify="center"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}
    >
      <SignInFlow />
    </View>
  );
}