import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className="page">
        <div className="container">{children}</div>
      </main>
    </>
  );
}
