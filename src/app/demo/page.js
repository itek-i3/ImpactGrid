import dynamic from 'next/dynamic';

const DemoWorkspaceClient = dynamic(() => import('./DemoWorkspaceClient'), {
  ssr: false,
});

export default function DemoPage() {
  return <DemoWorkspaceClient />;
}
