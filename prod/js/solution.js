'use strict';

const wrap = document.querySelector('.wrap');
const menuBlock = wrap.querySelector('.menu');
const drugElem = menuBlock.querySelector('.drag');
const commentElem = menuBlock.querySelector('.comments');
const drawElem = menuBlock.querySelector('.draw');
const shareElem = menuBlock.querySelector('.share');
const burgerElem = menuBlock.querySelector('.burger');
const newElem = menuBlock.querySelector('.new');
const imgElem = wrap.querySelector('.current-image');
const dropBg = wrap.querySelector('.drop-bg');
const comToggleElem = menuBlock.querySelector('.comments-tools');
const drawToolsElem = menuBlock.querySelector('.draw-tools');
const canvas = document.getElementById('canvas');
const errorElem = wrap.querySelector('.error');

let ctx = canvas.getContext('2d');
let inputFileElem;
let commentFormElem;
let ws;
let currentComment;
let imgElemCurrent;
let imgElemTemp;
let activeDrop = false;

const tools = Array.from(document.querySelectorAll('.tool'));
const modes = Array.from(document.querySelectorAll('.mode'));

function checkStart() {
  if (history.state && !document.location.search) {
    history.back();
  } else if (!document.location.search) {
    startPosition();
  } else {
    let id = document.location.search.replace('?id=', '');
    fetch(`https://neto-api.herokuapp.com/pic/${id}`)
      .then(response => {
        return response.json();
      })
      .then(json => {
        setImg(json);
        changeState('comments');
        createLink(json.id);
        rendAllComments(json);
        imgElem.addEventListener('load', () => {
          updateMask(json.mask);
        });
        saveState(json);
        commentFormElem = copyForm(wrap.querySelector('.comments__form'));
        ws = socketInit(json);
      })
      .catch(error => {
        createMsgElem(`Сервер вернул ошибку, загрузите изображение`);
        startPosition();
        console.log(error);
      });
  }
}

function socketInit(data) {
  const ws = new WebSocket(`wss://neto-api.herokuapp.com/pic/${data.id}`);
  ws.addEventListener('message', e => {
    let result = JSON.parse(e.data);
    if (result.event === 'comment') {
      let form;
      if (currentComment) {
        form = currentComment;
      } else {
        const scope = imgElem.getBoundingClientRect();
        form = createComment(scope.left + result.comment.left, scope.top + result.comment.top);
      }
      const comment = createCommentItem(form.querySelector('.comments__body'));
      comment.msg.textContent = result.comment.message;
      comment.time.textContent = getTimeStamp(result.comment.timestamp);
      form.dataset.id = result.comment.id;
      form[2].addEventListener('click', formCloseHandler);
      form[1].classList.add('hidden');
      form[3].classList.add('hidden');
      currentComment = false;
    } else if (result.event === 'mask') {
      updateMask(result.url);
    }
  });
  return ws;
}

function updateMask(img) {
  if (!imgElemCurrent) {
    imgElemCurrent = document.createElement('img');
    imgElemCurrent.classList.add('mask', 'hidden');
    wrap.appendChild(imgElemCurrent);
    imgElemCurrent.addEventListener('dragstart', e => e.preventDefault());
  }

  imgElemCurrent.src = img;

}

function setImg(data) {
  imgElem.src = data.url;
  imgElem.dataset.id = data.id;
  createInputFileElem();
}

function startPosition() {
  commentElem.classList.add('hidden');
  drawElem.classList.add('hidden');
  shareElem.classList.add('hidden');
  burgerElem.classList.add('hidden');
  activeDrop = true;
  createInputFileElem();
  commentFormElem = copyForm(wrap.querySelector('.comments__form'));
}

function copyForm(elem) {
  const form = elem.cloneNode(true);
  elem.remove();
  return form;
}

function changeState(state) {
  modes.forEach(function (key) {
    key.dataset.state = 'off';
    key.classList.add('hidden');
  });
  burgerElem.classList.remove('hidden');
  newElem.classList.add('hidden');
  wrap.dataset.state = state;
  if (state === 'share') {
    document.querySelector('.share-tools').classList.remove('tool');
    shareElem.classList.remove('hidden');
    shareElem.dataset.state = 'on';
  } else if (state === 'comments') {
    document.querySelector('.comments-tools').classList.remove('tool');
    commentElem.classList.remove('hidden');
    commentElem.dataset.state = 'on';
  } else if (state === 'draw') {
    document.querySelector('.draw-tools').classList.remove('tool');
    drawElem.classList.remove('hidden');
    drawElem.dataset.state = 'on';
  }
}

function saveState(data) {
  let link = `${document.location.origin}${document.location.pathname}?id=${data.id}`;
  window.history.pushState(null, null, link);
}

imgElem.addEventListener('dragstart', e => {
  e.preventDefault();
  return false;
});
wrap.addEventListener('drop', e => {
  e.preventDefault();
  if (!activeDrop) {
    return;
  }
  addFile(e.dataTransfer.files);
  dropBg.classList.add('hidden');
});
dropBg.addEventListener('dragleave', e => {
  e.stopPropagation();
  e.preventDefault();
  dropBg.classList.add('hidden');
});
wrap.addEventListener('dragenter', e => {
  e.stopPropagation();
  e.preventDefault();
  if (!activeDrop) {
    return;
  }
  dropBg.classList.remove('hidden');
});
wrap.addEventListener('dragover', e => e.preventDefault());

function createMsgElem(text, head) {
  errorElem.style.display = 'block';
  if (!head) {
    head = 'Ошибка';
  }
  errorElem.firstElementChild.textContent = head;
  errorElem.lastElementChild.textContent = text;
  setTimeout(function () {
    errorElem.style.display = 'none';
  }, 3000);
}

function createInputFileElem() {
  inputFileElem = document.createElement('input');
  inputFileElem.setAttribute('hidden', 'hidden');
  inputFileElem.type = 'file';
  inputFileElem.accept = 'image/jpeg,image/png';
  newElem.appendChild(inputFileElem);
  inputFileElem.addEventListener('change', e => {
    addFile(e.currentTarget.files);
  });
}

function createLink(id) {
  let link = `${document.location.origin}${document.location.pathname}?id=${id}`;
  const urlElem = document.querySelector('.menu__url');
  urlElem.value = link;
  document.querySelector('.menu_copy').addEventListener('click', e => {
    urlElem.select();
    document.execCommand('copy');
  });
}

function addFile(fileList) {
  if (!(fileList[0].type === 'image/jpeg' || fileList[0].type === 'image/png')) {
    createMsgElem('Неверный формат файла! Выберите jpg, png.');
    return;
  }

  const loader = wrap.querySelector('.image-loader');
  loader.style.display = 'block';

  const formData = new FormData();
  formData.append('title', fileList[0].name);
  formData.append('image', fileList[0]);
  fetch('https://neto-api.herokuapp.com/pic', {
    method: 'POST',
    body: formData
  })
    .then(response => {
      return response.json();
    })
    .then(json => {
      imgElem.src = json.url;
      imgElem.dataset.id = json.id;
      createLink(json.id);
      changeState('share');
      rendAllComments(json);
      saveState(json);
      createMsgElem(`Изображение ${fileList[0].name} загружено`, 'Успех!');
      activeDrop = false;
      ws = socketInit(json);
      loader.style.display = 'none';
    })
    .catch(error => {
      console.log(`Ошибка ${error}`);
      loader.style.display = 'none';
    });
}

let moveAction = false;
let shiftX = 0;
let shiftY = 0;

drugElem.addEventListener('mousedown', e => {
  shiftX = e.pageX - menuBlock.getBoundingClientRect().left - window.pageXOffset;
  shiftY = e.pageY - menuBlock.getBoundingClientRect().top - window.pageYOffset;
  moveAction = true;
});
document.addEventListener('mousemove', e => {
  if (moveAction) {
    let x = e.pageX - shiftX;
    let y = e.pageY - shiftY;

    const minX = 0;
    const minY = 0;
    const maxX = document.documentElement.clientWidth - menuBlock.offsetWidth - 5;
    const maxY = document.documentElement.clientHeight - menuBlock.offsetHeight;
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);

    menuBlock.style.left = x + 'px';
    menuBlock.style.top = y + 'px';
  }
});
document.addEventListener('mouseup', () => moveAction = false);
newElem.addEventListener('click', () => inputFileElem.click());

document.addEventListener('dragenter', e => {
  e.stopPropagation();
  e.preventDefault();
});

commentElem.addEventListener('click', toggleTool);
drawElem.addEventListener('click', toggleTool);
shareElem.addEventListener('click', toggleTool);

function toggleTool() {
  if (imgElemCurrent) {
    imgElemCurrent.classList.add('hidden');
  }
  if (imgElemTemp) {
    imgElemTemp.classList.add('hidden');
  }
  canvas.classList.add('hidden');
  tools.forEach(function (key) {
    key.classList.add('tool');
  });
  modes.forEach(function (key) {
    key.dataset.state = 'off';
  });

  this.nextElementSibling.classList.remove('tool');
  this.dataset.state = 'on';
  modes.forEach(elem => {
    if (elem.dataset.state === 'off') {
      elem.classList.add('hidden');
    }
  });
  if (this.classList.contains('draw')) {
    canvas.classList.remove('hidden');
    if (imgElemCurrent) {
      imgElemCurrent.classList.remove('hidden');
    }
    if (imgElemTemp) {
      imgElemTemp.classList.remove('hidden');
    }
    commentsToggle(false);
  }
}

burgerElem.addEventListener('click', () => {
  tools.forEach(function (key) {
    key.classList.add('tool');
  });

  shareElem.classList.remove('hidden');
  newElem.classList.remove('hidden');
  commentElem.classList.remove('hidden');
  drawElem.classList.remove('hidden');
});

// add comments handler
wrap.addEventListener('click', e => {
  if (!e.target.classList.contains('current-image')) {
    return;
  }
  for (let elem of wrap.querySelectorAll('.comments__form')) {
    if (!elem.querySelectorAll('.comments__input').value && !elem.querySelector('.comment')) {
      elem.remove();
    }
  }

  let x = e.pageX;
  let y = e.pageY;
  const scope = imgElem.getBoundingClientRect();
  if ((x < scope.left || x > scope.right) || (y < scope.top || y > scope.bottom)) {
    return;
  }

  const form = createComment(x, y, true);
  const formClose = form.querySelector('.comments__close');
  const formSubmit = form.querySelector('.comments__submit');

  formClose.addEventListener('click', formCloseHandler);
  formSubmit.addEventListener('click', sendForm);

  function sendForm(e) {
    e.preventDefault();
    const scope = imgElem.getBoundingClientRect();
    const form = e.target.closest('.comments__form');
    currentComment = form;
    if (form[1].value.length === 0) {
      form[1].placeholder = 'Введите текст...';
      return;
    }
    let left = form.offsetLeft - scope.left;
    let top = form.offsetTop - scope.top;
    let msg = `message=${form[1].value}&left=${left}&top=${top}`;
    fetch(`https://neto-api.herokuapp.com/pic/${imgElem.dataset.id}/comments`, {
      method: 'POST',
      headers: {
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: msg
    })
      .catch(error => {
        console.log(`Ошибка ${error}`);
      });
  }
});

function rendComments(data) {
  const scope = imgElem.getBoundingClientRect();
  for (let com in data.comments) {
    const form = createComment(scope.left + data.comments[com].left, scope.top + data.comments[com].top);

    const comment = createCommentItem(form.querySelector('.comments__body'));
    comment.msg.textContent = data.comments[com].message;
    comment.time.textContent = getTimeStamp(data.comments[com].timestamp);
    form.dataset.id = com;
    form[2].addEventListener('click', formCloseHandler);
    form[1].classList.add('hidden');
    form[3].classList.add('hidden');
  }
}

function getTimeStamp(date) {
  const time = new Date();
  time.setTime(date);
  let month = time.getMonth() + 1;
  let day = time.getDay();
  let hours = time.getHours();
  let min = time.getMinutes();
  if (month < 10) {
    month = '0' + month;
  }
  if (day < 10) {
    day = '0' + day;
  }
  if (hours < 10) {
    hours = '0' + hours;
  }
  if (min < 10) {
    min = '0' + min;
  }
  return `${day}.${month} - ${hours} : ${min}`;
}

function createCommentItem(parent) {
  const elem = {};
  elem.main = document.createElement('div');
  elem.main.classList.add('comment');

  elem.time = document.createElement('div');
  elem.msg = document.createElement('div');
  elem.time.classList.add('comment__time');
  elem.msg.classList.add('comment__message');

  elem.main.appendChild(elem.time);
  elem.main.appendChild(elem.msg);

  parent.insertBefore(elem.main, parent.children[0]);
  return elem;
}

function formCloseHandler(e) {
  const form = e.target.parentNode.parentNode;
  if (form.querySelector('.comments__input').value.length === 0 && !form.querySelector('.comment')) {
    form.remove();
  } else {
    form.querySelector('.comments__marker-checkbox').checked = false;
  }
}

function createComment(x, y, shift = false) {
  let markerX = 0;
  let markerY = 0;
  if(shift) {
    markerX = 20;
    markerY = 14;
  }
  const form = commentFormElem.cloneNode(true);
  form.style.left = x - markerX + 'px';
  form.style.top = y - markerY + 'px';
  wrap.appendChild(form);
  form[0].checked = true;
  form[0].addEventListener('change', e => {
    e.target.checked = true;
    e.preventDefault();
  });
  form[1].focus();
  return form;
}

function rendAllComments(data) {
  if (imgElem.width <= 0) {
    imgElem.addEventListener('load', () => {
      rendComments(data);
    });
  } else {
    rendComments(data);
  }
  commentsToggle();
}

comToggleElem.addEventListener('click', e => {
  if (e.target.classList.contains('menu__toggle')) {
    commentsToggle();
  }
});

function commentsToggle(off = true) {
  const list = wrap.querySelectorAll('.comments__form');
  const checkBox = document.getElementById('comments-on');
  let check = false;

  if (checkBox.checked && off) {
    check = true;
  }

  for (let form of list) {
    const checkbox = form.querySelector('.comments__marker-checkbox');
    checkbox.checked = check;
  }
}

drawToolsElem.addEventListener('click', e => {
  if (e.target.classList.contains('menu__color')) {
    color = window.getComputedStyle(e.target.nextElementSibling).backgroundColor;
  } else if (e.target.classList.contains('menu__eraser')) {
    clear();
    sendMask();
  }
});

let sendPoint = true;

function sendMask() {
  if (sendPoint) {
    if(!imgElemTemp) {
      imgElemTemp = document.createElement('img');
      imgElemTemp.classList.add('mask','mask-temp');
      wrap.appendChild(imgElemTemp);
      imgElemTemp.addEventListener('load', () => {
        canvas.toBlob(function (blob) {
          ws.send(blob);
          clear();
        });


      })
    }
    imgElemTemp.src = canvas.toDataURL();

    sendPoint = false
  }
}

setInterval(function () {
  if (!sendPoint) {
    sendPoint = true;
  }
}, 1000);

window.addEventListener('beforeunload', () => {
  ws.close(1000);
});

// canvas

imgElem.addEventListener('load', e => {
  canvas.width = e.target.width;
  canvas.height = e.target.height;
});

let mouse = {x: 0, y: 0};
let draw = false;
let brushWidht = 10;
let color = '#6ebf44';

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

canvas.addEventListener("mousedown",  (e) => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  draw = true;
  ctx.beginPath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.moveTo(mouse.x, mouse.y);
});

canvas.addEventListener("mousemove", (e) => {
  if (draw === true) {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
    ctx.lineWidth = brushWidht;
    ctx.strokeStyle = color;
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
  }
});

canvas.addEventListener("mouseup", (e) => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  ctx.lineTo(mouse.x, mouse.y);
  ctx.stroke();
  ctx.closePath();
  draw = false;
  sendMask();
});

checkStart();