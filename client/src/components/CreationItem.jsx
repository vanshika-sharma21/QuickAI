import { useState } from 'react'
import Markdown from 'react-markdown'

const CreationItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className='p-4 max-w-5xl text-sm bg-white border border-gray-200 rounded-lg cursor-pointer'
      onClick={() => setExpanded((v) => !v)}
    >
      <div className='flex justify-between items-center gap-4'>
        <div>
          <h2 className='font-medium text-gray-800'>{item.prompt}</h2>

          <p className='text-gray-500 mt-1'>
            ij - {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>

          <button className='bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] px-4 py-1 rounded-full'>
            ij
          </button>
      </div>

      {expanded && (
        <div className='mt-3 h-full overflow-y-scroll text-sm text-slate-700'>
          {item.type === 'image' ? (
            <img
              src={item.content}
              alt='Generated image'
              className='w-full max-w-md'
            />
          ) : (
            <div className='reset-tw'><Markdown>{item.content}</Markdown></div>
          )}
        </div>
      )}
    </div>
  )
}

export default CreationItem
