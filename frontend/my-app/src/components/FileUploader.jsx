import { useRef } from "react";

function FileUploader({ onFileSelect }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current.click();
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,image/*"
        onChange={handleChange}
      />

      <button
        onClick={handleClick}
        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
      >
        Upload Image / PDF
      </button>
    </div>
  );
}

export default FileUploader;