'use server';
import { db } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  fields?: {
    customerId?: string;
    amount?: string;
    status?: string;
  };
  message?: string | null;
}

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State,  formData: FormData): Promise<State> {
  const validateFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validateFields.success) {
    return {
      errors: validateFields.error.flatten().fieldErrors,
      message: 'Missing fields. Failed to create invoice.',
    };
  }

  const { amount, customerId, status } = validateFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
  const client = await db.connect();

  try {
    await client.sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date});
    `;
  } catch (error) {
    client.release();
    return {
      message: 'Database Error: Failed to create invoice'
    };
  }

  client.release();

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// ...
 
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  const amountInCents = amount * 100;
  const client = await db.connect();
 
  try {
    await client.sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    client.release();
    return {
      message: 'Database Error: Failed to update invoice',
    }
  }


  client.release();
 
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  throw new Error('Failed to delete Invoice');
  const client = await db.connect();
  try {
    await client.sql`
      DELETE FROM invoices WHERE id = ${id}
    `;
    client.release();
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice' };
  } catch (error) {
    client.release();
    return { message: 'Database Error: Failed to delete invoice' };
  }
};
