/** Datos serializables que la página pasa a los componentes de cliente de reservas. */

export type AmenityInfo = {
  id: string;
  name: string;
  /** "HH:MM" */
  open: string;
  /** "HH:MM" (si es <= open, cierra al día siguiente) */
  close: string;
  maxHours: number;
};

export type Booking = {
  id: string;
  amenityId: string;
  /** Día de inicio en Colombia, "YYYY-MM-DD". */
  date: string;
  /** "HH:MM" en Colombia. */
  from: string;
  to: string;
  /** Termina al día siguiente. */
  overnight: boolean;
  /** Solo para el personal (los residentes ven "Reservado"). */
  unit?: string;
};
