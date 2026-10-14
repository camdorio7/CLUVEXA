import Shell from "../../components/Shell";
export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
