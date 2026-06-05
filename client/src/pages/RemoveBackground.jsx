import { useState } from 'react'
import { Eraser } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuth } from '@clerk/clerk-react'

// BACKEND URL
axios.defaults.baseURL = 'http://localhost:3000'

const RemoveBackground = () => {

  const [input, setInput] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const { getToken } = useAuth()

  const disabled = loading || !input

  // ================= SUBMIT =================

  const onSubmitHandler = async (e) => {
    e.preventDefault()

    try {

      setLoading(true)

      const formData = new FormData()

      // IMPORTANT
      formData.append('image', input)

      const token = await getToken()

      const { data } = await axios.post(
        '/api/ai/remove-background',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      if (data.success) {

        setContent(data.content)

        toast.success(
          'Background removed successfully'
        )

      } else {

        toast.error(
          data.message || 'Failed to remove background'
        )
      }

    } catch (error) {

      console.log(error)

      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong'
      )

    } finally {

      setLoading(false)
    }
  }

  return (

    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>

      {/* LEFT SIDE */}

      <form
        onSubmit={onSubmitHandler}
        className='w-full max-w-lg p-4 bg-white rounded-xl border border-gray-200 shadow-sm'
      >

        {/* HEADER */}

        <div className='flex items-center gap-3'>

          <div className='bg-orange-100 p-2 rounded-lg'>
            <Eraser className='w-6 h-6 text-[#FF4938]' />
          </div>

          <div>
            <h1 className='text-xl font-semibold'>
              Background Removal
            </h1>

            <p className='text-sm text-gray-500'>
              Remove image backgrounds instantly
            </p>
          </div>

        </div>

        {/* INPUT */}

        <p className='mt-6 text-sm font-medium'>
          Upload image
        </p>

        <input
          type='file'
          accept='image/*'
          required
          onChange={(e) =>
            setInput(e.target.files?.[0] || null)
          }
          className='w-full p-3 mt-2 text-sm rounded-lg border border-gray-300 text-gray-600 outline-none'
        />

        <p className='text-xs text-gray-500 mt-2'>
          Supports JPG, PNG, WEBP and more
        </p>

        {/* IMAGE PREVIEW */}

        {input && (
          <img
            src={URL.createObjectURL(input)}
            alt='preview'
            className='mt-4 w-full h-56 object-contain rounded-lg border'
          />
        )}

        {/* BUTTON */}

        <button
          disabled={disabled}
          className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#F6AB41] to-[#FF4938] text-white px-4 py-3 mt-6 rounded-lg disabled:opacity-60'
        >

          {loading ? (

            <>
              <span className='w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin'></span>
              <span>Processing...</span>
            </>

          ) : (

            <>
              <Eraser className='w-5 h-5' />
              <span>Remove Background</span>
            </>

          )}

        </button>

      </form>

      {/* RIGHT SIDE */}

      <div className='w-full max-w-lg p-4 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[500px]'>

        <div className='flex items-center gap-3'>

          <div className='bg-orange-100 p-2 rounded-lg'>
            <Eraser className='w-5 h-5 text-[#FF4938]' />
          </div>

          <div>
            <h1 className='text-xl font-semibold'>
              Processed Image
            </h1>

            <p className='text-sm text-gray-500'>
              Your result will appear here
            </p>
          </div>

        </div>

        {!content ? (

          <div className='flex flex-col items-center justify-center h-[400px] text-gray-400'>

            <Eraser className='w-12 h-12 mb-4' />

            <p className='text-sm'>
              Upload an image to remove background
            </p>

          </div>

        ) : (

          <div className='mt-6'>

            <img
              src={content}
              alt='result'
              className='w-full rounded-lg border object-contain'
            />

            {/* DOWNLOAD BUTTON */}

            <a
              href={content}
              download='removed-background.png'
              className='mt-4 inline-block w-full text-center bg-black text-white py-3 rounded-lg'
            >
              Download Image
            </a>

          </div>

        )}

      </div>

    </div>
  )
}

export default RemoveBackground