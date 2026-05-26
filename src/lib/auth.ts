export function isLoggedIn() {
  return !!localStorage.getItem('accessToken')
}

export function logout() {
  localStorage.clear()
  window.location.href = '/login'
}
