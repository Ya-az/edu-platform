import './Loader.css';

export default function Loader({ size = 40, fullPage = false }) {
  if (fullPage) {
    return (
      <div className="loader-fullpage">
        <div className="loader" style={{ width: size, height: size }} />
      </div>
    );
  }

  return (
    <div className="loader-container">
      <div className="loader" style={{ width: size, height: size }} />
    </div>
  );
}
