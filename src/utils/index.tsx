export const extractPdfText = async (page: any) => {
  const textContent = await page.getTextContent();
  return textContent.items.map((item: any) => ({
    str: item.str,
    x: item.transform[4],
    y: page.getViewport({ scale: 1 }).height - item.transform[5],
    width: item.width,
    height: item.height,
    fontSize: item.transform[0],
  }));
};
