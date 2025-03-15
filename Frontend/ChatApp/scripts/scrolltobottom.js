const scrollToBottom = (id_of_element) => {
    const element = document.getElementById(id_of_element);
    if (!element) return;
    
    element.scrollTo({
        top: element.scrollHeight,
        behavior: "smooth"
    });
};


export default scrollToBottom;