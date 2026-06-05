import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import axios from "axios";

const ReviewResume = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    if (!file) {
      alert("Please select a resume");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("resume", file);


      const { data } = await axios.post(
        "/api/ai/resume-review",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      if (data.success) {
        setResult(data.content);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Failed to review resume"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-scroll p-6 flex flex-wrap gap-4 text-slate-700">

      {/* Left Section */}
      <form
        onSubmit={onSubmitHandler}
        className="w-full max-w-lg p-5 bg-white rounded-lg border border-gray-200"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 text-[#00DA83]" />
          <h1 className="text-xl font-semibold">
            Resume Review
          </h1>
        </div>

        <p className="mt-6 text-sm font-medium">
          Upload Resume
        </p>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile(e.target.files[0])
          }
          className="w-full p-2 px-3 mt-2 border border-gray-300 rounded-md"
          required
        />

        <p className="text-xs text-gray-500 mt-1">
          Supports PDF resumes only
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00DA83] to-[#009BB3] text-white px-4 py-2 mt-6 rounded-lg"
        >
          <FileText className="w-5" />

          {loading
            ? "Analyzing Resume..."
            : "Review Resume"}
        </button>
      </form>

      {/* Right Section */}
      <div className="w-full max-w-lg p-5 bg-white rounded-lg border border-gray-200 min-h-[500px]">

        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#00DA83]" />
          <h1 className="text-xl font-semibold">
            Analysis Results
          </h1>
        </div>

        {!result ? (
          <div className="flex justify-center items-center h-[400px] text-gray-400 text-center">
            Upload a resume and click
            <br />
            "Review Resume" to get started
          </div>
        ) : (
          <div className="mt-5 overflow-auto max-h-[400px]">
            <pre className="text-sm whitespace-pre-wrap break-words">
              {typeof result === "string"
                ? result
                : JSON.stringify(
                    result,
                    null,
                    2
                  )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewResume;