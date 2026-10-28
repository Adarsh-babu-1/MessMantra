import { api, el, renderHeader, saveSession, session, home, toast } from './common.js';

const s = session();
if (s) location.href = home[s.user.role];
renderHeader();

let signup = false;
const $ = (id) => document.getElementById(id);
$('swap').addEventListener('click', () => {
  signup = !signup;
  $('title').textContent = signup ? 'Create student account' : 'Login';
  $('go').textContent = signup ? 'Sign up' : 'Login';
  $('swap').textContent = signup ? 'Have an account? Login' : 'New student? Sign up';
  $('nameWrap').hidden = !signup;
});
$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const body = { email: $('email').value, password: $('password').value };
    if (signup) body.name = $('name').value;
    const data = await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body });
    saveSession(data);
    location.href = home[data.user.role];
  } catch (err) { toast(err.message, true); }
});
