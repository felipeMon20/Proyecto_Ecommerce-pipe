export const REGIONES = [
  ['RM', 'Región Metropolitana'],
  ['Arica y Parinacota', 'Arica y Parinacota'],
  ['Tarapacá', 'Tarapacá'],
  ['Antofagasta', 'Antofagasta'],
  ['Atacama', 'Atacama'],
  ['Coquimbo', 'Coquimbo'],
  ['Valparaíso', 'Valparaíso'],
  ["O'Higgins", "O'Higgins"],
  ['Maule', 'Maule'],
  ['Ñuble', 'Ñuble'],
  ['Biobío', 'Biobío'],
  ['La Araucanía', 'La Araucanía'],
  ['Los Ríos', 'Los Ríos'],
  ['Los Lagos', 'Los Lagos'],
  ['Aysén', 'Aysén'],
  ['Magallanes', 'Magallanes'],
]

export const costoEnvio = (region) => (region === 'RM' ? 3000 : 6000)
