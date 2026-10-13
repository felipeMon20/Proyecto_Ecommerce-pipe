import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export const CarritoContext = createContext(null)
export const useCarrito = () => useContext(CarritoContext)
