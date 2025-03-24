
export const RequestService = (path, data) => {
    const header_data = {
        'Content-Type': 'application/json'
    }
    if (localStorage.getItem("token")){
        header_data["Authorization"] = `Bearer ${localStorage.getItem("token")}`
    }
    var body = JSON.stringify(data) 
    var path = `http://0.0.0.0:8084${path}`
    return fetch(path, {
        method: "POST",
        headers: header_data,
        body: body
    }).then(res => res.json())
}


export const RequestUrlService = (path, data) => {
    const header_data = {
        'Content-Type': 'application/json'
    }
    if (localStorage.getItem("token")){
        header_data["Authorization"] = `Bearer ${localStorage.getItem("token")}`
    }
    var body = JSON.stringify(data) 
    var path = `http://0.0.0.0:8084${path}`
    return fetch(path, {
        method: "POST",
        headers: header_data,
        body: body
    }).then(res => res.json())
}

