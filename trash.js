// <div className="flex h-screen overflow-hidden">
//   {/* Sidebar */}
//   <div className="w-52 bg-[#08043F] border-r">
//     <ThumbnailSidebar
//       numberPages={numberPages}
//       pageNumber={pageNumber}
//       pdfFile={fileUrl || ""}
//       setPageNumber={setPageNumber}
//     />
//   </div>

//   {/* Main Editor */}
//   <div className="flex-1 flex flex-col">
//     {/* Top Toolbar */}
//     <div className="flex items-center p-5 justify-between w-full">
//       <div className="back flex items-center gap-x-2">
//         <button
//           className="rounded-full bg-[#F2F2F7] p-2"
//           onClick={() => window.history.back()}
//           type="button"
//         >
//           <ArrowLeftIcon className="text-black w-3 " />
//         </button>
//         <span className="text-lg font-semibold text-black">
//           {/* {state.title} */}
//         </span>
//       </div>

//       <div className="flex items-center justify-center gap-x-3">
//         {/* <button
//           onClick={handleUndo}
//           className='px-6 py-2 font-medium  text-sm rounded-xl bg-gray-200 text-black'
//           type='button'
//         >
//           undo
//         </button>
//         <button
//           onClick={handleRedo}
//           className='px-6 py-2 font-medium  text-sm rounded-xl bg-gray-200 text-black'
//           type='button'
//         >
//           redo
//         </button> */}
//         <button
//           className={`px-6 py-2 flex items-center justify-center font-medium ${
//             preloader || (!pdfOverlayFabricRef?.current && "opacity-50")
//           } text-sm rounded-xl bg-black text-white`}
//           disabled={preloader || !pdfOverlayFabricRef?.current}
//           onClick={async () => handleSaveOverlayAsSingleImage(fileUrl)}
//           type="button"
//         >
//           {preloader ? <LuLoader className="animate-spin" /> : "Save"}
//         </button>
//       </div>
//     </div>
//     <div className="px-5 pb-3 border-b shadow-lg bg-white  flex w-full items-center justify-between">
//       <PdfToolbar
//         drawImagetoPdf={drawStampOnCanvas}
//         handleAddText={handleAddText}
//         numberPages={numberPages}
//         pageNumber={pageNumber}
//         selectedStamp={selectedStamp}
//         setSelectedStamp={setSelectedStamp}
//         setShowdrawingbox={setShowdrawingbox}
//         showdrawingbox={showdrawingbox}
//         // signatures={profile?.signatures}
//       />

//       <ZoomDropdown
//         // @ts-ignore
//         containerRef={viewerRef}
//         setScale={setScale}
//       />
//     </div>
//     {/* PDF View */}
//     <TextToolbar
//       downloadPdf={downloadPdf}
//       handleDownload={handleDownload}
//       selectedFont={selectedFont}
//       selectedSize={selectedSize}
//       setSelectedColor={setSelectedColor}
//       setSelectedFont={setSelectedFont}
//       setSelectedSize={setSelectedSize}
//       ToggleTextStyle={ToggleTextStyle}
//       updateTextStyle={updateTextStyle}
//     />
//     <div
//       className="flex-1 overflow-auto  touch-none pt-88 flex justify-center items-center bg-gray-50"
//       ref={viewerRef}
//     >
//       <div
//         className="transition-transform duration-300 ease-in-out origin-top relative"
//         ref={pdfPageRef}
//         style={{ transform: `scale(${scale})` }}
//       >
//         <Document
//           file={fileUrl}
//           key={fileUrl}
//           onLoadSuccess={handleDocumentLoad}
//         >
//           <Page
//             onRenderSuccess={handlePageOnloadSuccess}
//             pageNumber={pageNumber}
//             renderAnnotationLayer={false}
//             renderTextLayer={false}
//             scale={1}
//           />
//         </Document>

//         {/* saved drawing here */}

//         {/* display saved drawing here */}
//         <div
//           className="absolute top-0 left-0 z-30 w-full h-full pointer-events-auto"
//           ref={pdfOverlayContainerRef}
//           style={{
//             transform: `scale(${scale})`,
//             transformOrigin: "top left",
//           }}
//         />
//       </div>
//     </div>
//     {showdrawingbox && (
//       <div
//         className="fixed top-24 left-24 z-50 bg-white shadow-lg border border-gray-300"
//         ref={canvaContainerRef}
//         style={{ width: 300, height: 200 }}
//       >
//         <div
//           className="cursor-move flex justify-between items-center px-2 py-1 bg-gray-100 border-b border-gray-300"
//           ref={dragHandleRef}
//         >
//           <span className="text-sm text-gray-600">Drawing</span>
//           <div className="flex items-center gap-4">
//             {startedDrawing && (
//               <>
//                 {/* <button
//                   title='undo'
//                   onClick={handleUndo}
//                   // onClick={handleExportDrawimgAsImage}
//                   className='text-gray-500 hover:text-orange-500 text-sm font-bold'
//                 >
//                   <FaUndo />
//                 </button>
//                 <button
//                   title='redo'
//                   onClick={handleRedo}
//                   className='text-gray-500 hover:text-green-500 text-sm font-bold'
//                 >
//                   <FaRedo />
//                 </button> */}
//                 <button
//                   className="text-gray-500 hover:text-orange-500 text-sm font-bold"
//                   onClick={handleClearCanvas}
//                   title="erase"
//                   type="button"
//                 >
//                   <FaEraser />
//                 </button>
//                 <button
//                   className="text-gray-500 hover:text-green-500 text-sm font-bold"
//                   onClick={handleExportDrawingToPdf}
//                   title="save"
//                   type="button"
//                 >
//                   <FaCheck />
//                 </button>
//               </>
//             )}
//             <button
//               className="text-gray-500 hover:text-red-500 text-sm font-bold"
//               onClick={() => {
//                 setShowdrawingbox(false);
//                 setStartedDrawing(false);
//               }}
//               title="close"
//               type="button"
//             >
//               ✕
//             </button>
//           </div>
//         </div>

//         <div
//           className="relative w-full h-[calc(100%-32px)]"
//           onMouseDown={() => {
//             setIsDrawing(true);
//             setStartedDrawing(true);
//           }}
//           onMouseUp={() => setIsDrawing(false)}
//         >
//           {!isDrawing && (
//             <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none z-10">
//               Draw here
//             </div>
//           )}
//           {/* Fabric canvas will go here */}

//           <div className="absolute inset-0 z-20" ref={canvasContainerRef} />
//         </div>
//       </div>
//     )}
//   </div>
// </div>
